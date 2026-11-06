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
import CarteMois from './CarteMois.jsx';
import { SheetShell } from '../composants/SheetShell.jsx';
import { montant } from '../format.js';
import './aideCarte.css';
import { AIDE_CHIFFRES, CHIFFRES, NOM_PERIODE, PAGES_CARTE, PLAGE_IDS, clePeriode, chiffresProposes, courbeVendu, defDe, horsSelection, libelleCase, nomPeriode, periodeDefaut, raisonCourte, reglageAEnregistrer, reglageDePage, valeursCarte, valeurChiffre, valeurObjectif } from './carteChiffres.js';
import { TYPES_OBJECTIF, lireSaisieObjectif, objectifAEnregistrer, objectifSurPage, progressionObjectif } from '../objectifMois.js';
import ChoixPeriode from '../ChoixPeriode.jsx';
import { raccourcisCarte, etiquettePlage, cleJour } from '../periodeCalendrier.js';

// ── LA PÉRIODE D'UNE PLACE ↔ LA VALEUR DU CALENDRIER (3 nov., Julien : « fais un calendrier ») ──
// Une période NOMMÉE (jour, semaine, mois, trimestre, année) reste un mot : la carte la calcule
// par ses règles ; une plage libre devient `{ de, a, label }` (bornes [de, a) en heure locale).
const TOKENS_CAL = ['jour', 'semaine', 'mois', 'trimestre', 'annee'];
export const valeurDePeriode = (p, maintenant = new Date()) => {
  if (!p) return null;
  if (typeof p === 'object') { if (p.hors) return null; const a = new Date(Number(p.a)); a.setDate(a.getDate() - 1); return { from: new Date(Number(p.de)), to: a, label: p.label }; }
  const r = raccourcisCarte(maintenant).find((x) => x.cle === p);
  return r ? { ...r.valeur } : null;
};
export const periodeDeValeur = (v, permis, maintenant = new Date()) => {
  if (!v || !v.from) return undefined;
  const to = v.to || v.from;
  const r = raccourcisCarte(maintenant).find((x) => TOKENS_CAL.includes(x.cle) && cleJour(x.valeur.from) === cleJour(v.from) && cleJour(x.valeur.to) === cleJour(to));
  if (r && permis.includes(r.cle)) return r.cle;
  const de = new Date(v.from); de.setHours(0, 0, 0, 0);
  const a = new Date(to); a.setHours(0, 0, 0, 0); a.setDate(a.getDate() + 1);
  return { de: de.getTime(), a: a.getTime(), label: etiquettePlage(v.from, to) };
};

const centimes = (v, type) => (v == null ? '' : type === 'eur' ? String(Math.round(Number(v) * 100)) : String(v));
// (5 nov., chantier E1) Les euros ronds par `montant()` (src/format.js) : la même écriture partout.
const euros = (v) => montant(v, { centimes: 'jamais' });

// `x` = une valeur de `valeursCarte` ; `grand` : le grand chiffre (centimes).
const affiche = (x, fmt, grand) => {
  if (x.def && x.def.local && x.def.affiche !== undefined && x.valeur != null) return x.def.affiche;
  if (x.valeur == null) return null;
  const t = (x.def && x.def.type) || 'n';
  // Dans une case : les centimes tant que ça tient (moins de 1 000 €), l'euro rond au-delà (jamais rogné).
  // (6 nov., onglets A) Les milliers séparés comme partout ailleurs : « 1 514,33 € », pas « 1514,33 € »
  // (le `fmt` des règles est sans séparateur) ; une case de 1 000 € ou plus reste à l'euro.
  const corps = t === 'eur' ? ((grand || Math.abs(Number(x.valeur)) < 1000) ? montant(x.valeur) : euros(x.valeur)) : String(x.valeur);
  if (!x.partiel) return corps;
  // (3 nov.) Jamais « ≥ » sur une case : le chiffre seul, « au moins » dans son titre (`titreDe`).
  return grand ? <><span className="vrm-fu-borne">au moins</span>{corps}</> : corps;
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
  // (5 nov., chantier E1) Des ventes sans date de versement : la phrase entière.
  if (x.raison === 'a-dater') return `${x.def ? x.def.nom : ''} : pas su — ${x.aDater} vente${x.aDater > 1 ? 's' : ''} sans date de versement (à dater), dans aucun mois`;
  if (x.valeur != null && x.aDater > 0) return `${x.def ? x.def.nom : ''} daté au versement — sans ${x.aDater} vente${x.aDater > 1 ? 's' : ''} encore à dater`;
  if (x.valeur == null && !x.def?.local) return `${x.def ? x.def.nom : ''} : pas su — ${raisonCourte(x)}`;
  if (x.partiel && x.manque && x.manque.length) return `Au moins : ${x.manque.join(', ')} pas lu`;
  if (x.partiel) return `Au moins · ${x.def ? x.def.nom : ''}`;
  if (x.def && x.def.titre) return x.def.titre;
  return x.def ? x.def.nom : '';
};

const majuscule = (s) => (typeof s === 'string' && s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// ── LA BARRE DE L'OBJECTIF (4 nov.) ─────────────────────────────────────────
// Fine, sous les cases : « Objectif » à gauche, « 1 240 / 2 000 € » à droite,
// la piste remplie au pourcentage. Pas su ⇒ « — » et piste vide ; partiel ⇒
// « au moins » dans le titre (§5). Aucun objectif ⇒ la barre n'existe pas.
export function BarreObjectif({ prog, fmt }) {
  if (!prog) return null;
  const eur = prog.type === 'ca';
  const montre = (v) => (eur ? euros(v) : String(v));
  const cible = montre(prog.objectif);
  const titre = prog.valeur == null ? 'Objectif du mois : pas su'
    : `${prog.partiel ? 'Au moins ' : ''}${eur ? fmt(prog.valeur) : prog.valeur} sur ${eur ? fmt(prog.objectif) : prog.objectif}${prog.partiel && prog.manque.length ? ` · ${prog.manque.join(', ')} pas lu` : ''}`;
  return (
    <div className="vrm-fu-objectif" data-objectif={prog.type} data-objectif-cible={eur ? String(Math.round(prog.objectif * 100)) : String(prog.objectif)}
      data-objectif-valeur={prog.valeur == null ? '' : (eur ? String(Math.round(prog.valeur * 100)) : String(prog.valeur))}
      data-objectif-pct={prog.pct == null ? '' : String(prog.pct)} data-objectif-partiel={prog.partiel ? '1' : undefined} data-objectif-atteint={prog.atteint ? '1' : undefined} title={titre}>
      <div className="vrm-fu-objectif-ligne">
        <span>Objectif</span>
        <b>{prog.valeur == null ? '—' : <>{montre(prog.valeur)}<span className="vrm-fu-objectif-sur"> / {cible}</span></>}</b>
      </div>
      <div className="vrm-fu-objectif-piste" role="progressbar" aria-label="Objectif du mois" aria-valuemin={0} aria-valuemax={100} aria-valuenow={prog.pct == null ? undefined : prog.pct}>
        {prog.pct ? <span style={{ width: `${prog.pct}%` }} /> : null}
      </div>
    </div>
  );
}

// (6 nov., onglets A) « ? » : d'où vient chaque chiffre de la carte — sa phrase (rangée avec sa
// définition, `AIDE_CHIFFRES` ou `aide` d'une case propre à la page), la valeur montrée, et ce qui
// manque (la même phrase que son infobulle, `titreDe`). Rien n'est recalculé ici.
function FeuilleAide({ page, places, fmt, fermer, FermeAuRetour, surtitre }) {
  return (
    <SheetShell titre="D’où viennent ces chiffres" sousTitre={surtitre || ''} onClose={fermer} FermeAuRetour={FermeAuRetour}
      z={20000} maxWidth={560} className="vrm-carte-aide-feuille" data-noswipe="" data-carte-aide-feuille={page}>
      <dl className="vrm-carte-aide">
        {places.map((x) => {
          const nom = x.def ? (x.def.local ? (x.def.nom || x.def.court) : x.def.nom) : '';
          const phrase = (x.def && x.def.local ? x.def.aide : AIDE_CHIFFRES[x.place.id]) || '';
          const v = affiche(x, fmt, false);
          const etat = titreDe(x);
          const note = !etat || etat === nom ? '' : etat.startsWith(nom + ' : ') ? majuscule(etat.slice(nom.length + 3)) : etat;
          return (
            <div key={x.place.id + (x.p && typeof x.p === 'string' ? '-' + x.p : '')} className="vrm-carte-aide-ligne" data-carte-aide-chiffre={x.place.id}>
              <dt><span>{majuscule(nom)}</span><b>{v == null ? '—' : (x.partiel ? <>au moins {v}</> : v)}</b></dt>
              {phrase ? <dd>{phrase}</dd> : null}
              {note ? <dd className="vrm-carte-aide-etat">{note}</dd> : null}
            </div>
          );
        })}
      </dl>
    </SheetShell>
  );
}

export default function CarteStats({ owner = '', page, sel, sources, regles, reglage, poser, attrsDe = null, onNav = null, nu = false, className = '', FermeAuRetour = null, sous = null, extra = {}, clics = null, objectif = null, poserObjectif = null, aide = false }) {
  const [ouvert, setOuvert] = React.useState(false);
  const [aideOuverte, setAideOuverte] = React.useState(false);
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
  const prog = objectifSurPage(objectif, page) ? progressionObjectif(objectif, valeurObjectif(objectif, sources, regles)) : null;
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
        sous={sous || <span className="vrm-fu-sous-nom">{g.def ? (g.def.local ? (g.def.court || g.def.nom) : g.def.court) : ''}{aide ? <button type="button" className="vrm-fu-aide" data-carte-aide={page} aria-label="D’où viennent ces chiffres ?" title="D’où viennent ces chiffres ?" onClick={() => setAideOuverte(true)}><span aria-hidden="true">?</span></button> : null}</span>}
        courbe={courbe && courbe.length > 1 ? courbe : null}
        pile={extra.pile || null}
        cases={V.c.map((x) => ({
          cle: x.place.id + (x.p && typeof x.p === 'string' ? '-' + x.p : ''),
          n: affiche(x, fmt, false),
          // (3 nov., finitions) Capitale initiale sur chaque case (« À poster », « Finalisées »).
          // (3 nov.) Le libellé court seul (jamais « … · Vinted » rogné) : le site se dit dans le titre de la case.
          l: majuscule(x.def ? (x.def.local ? (x.def.court || x.def.nom) : libelleCase({ ...x.def, vinted: false }, x.p, g.p, sel)) : ''),
          titre: titreDe(x),
          // (5 nov., chantier E1, §5) Un « — » dit sa raison sous le libellé ; un montant qui
          // laisse des ventes « à dater » le dit aussi.
          raison: raisonCourte(x),
          onClick: aller(x),
          attrs: { ...attrsDeValeur(x, page), ...(x.attrs || {}), ...(x.def && x.def.local && x.def.attrs ? x.def.attrs : {}), ...(plus(x) || {}) },
        }))}>
        {prog ? <BarreObjectif prog={prog} fmt={fmt} /> : null}
      </CarteMois>
      {aide && aideOuverte ? <FeuilleAide page={page} places={[g, ...V.c]} fmt={fmt} fermer={() => setAideOuverte(false)} FermeAuRetour={FermeAuRetour} surtitre={V.perimetre} /> : null}
      {ouvert ? <FeuilleCarte owner={owner} page={page} sel={sel} sources={sources} regles={regles} reglage={reglage} poser={poser} locaux={locaux} fermer={() => setOuvert(false)} FermeAuRetour={FermeAuRetour} objectif={objectif} poserObjectif={poserObjectif} /> : null}
    </>
  );
}

// ── LA FEUILLE « MODIFIER » ─────────────────────────────────────────────────
// Quatre places (le grand chiffre, trois cases) ; on touche une place, puis le
// chiffre qui y va. La période se choisit pour CE chiffre quand la page n'a pas
// son propre filtre de période. Chaque choix est rangé tout de suite (la carte,
// derrière, change sous ses yeux) ; « Par défaut » rend la carte des maquettes.
function FeuilleCarte({ owner = '', page, sel, sources, regles, reglage, poser, locaux, fermer, FermeAuRetour, objectif = null, poserObjectif = null }) {
  const R = reglageDePage(reglage, page, locaux);
  const [place, setPlace] = React.useState(0);
  const places = [R.g, ...R.c];
  const actuelle = places[place] || null;
  const choisir = (id, p) => {
    const d = defDe(id, locaux);
    const nouvelle = Array.isArray(d && d.periodes) ? { id, p: p || (actuelle && actuelle.id === id && actuelle.p) || periodeDefaut(d) } : { id };
    const L = places.slice();
    // Le même chiffre à la même période ailleurs sur la carte : les deux places s'échangent (§7 : un nombre, une fois).
    const dejaIci = L.findIndex((x, i) => i !== place && x && x.id === nouvelle.id && clePeriode(x.p) === clePeriode(nouvelle.p));
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
    return (v.partiel ? 'au moins ' : '') + (d.type === 'eur' ? euros(v.valeur) : String(v.valeur));
  };
  // (5 nov., chantier E1) La feuille unique de l'app (`SheetShell`, chantier B) : portail, fond
  // opaque dès la première image, poignée au doigt, titre et croix en icône, retour du navigateur.
  // Chaque choix est rangé tout de suite : la croix suffit (plus de « OK » à côté d'elle).
  return (
    <SheetShell titre={(PAGES_CARTE[page] && PAGES_CARTE[page].nom) || 'La carte'} sousTitre="Les chiffres de la carte" onClose={fermer} FermeAuRetour={FermeAuRetour}
      z={20000} maxWidth={560} className="vrm-carte-feuille" data-noswipe="" data-carte-feuille={page}>
        <div className="vrm-carte-feuille-corps">
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
          {/* (3 nov.) La période : un CALENDRIER (le même que Ventes, Achats et Statistiques) pour un chiffre
              qui se calcule sur des dates libres ; sinon ses seules périodes (Mois · Trimestre · Année),
              en contrôle segmenté sur une rangée — plus de rangée qui défile de côté. */}
          {def && !def.local && Array.isArray(def.periodes) && def.periodes.length > 1 && !periodePage ? (PLAGE_IDS.includes(actuelle.id) ? (
            <div className="vrm-carte-periode-cal" data-carte-calendrier={actuelle.id}>
              <ChoixPeriode owner={owner} value={valeurDePeriode(actuelle.p)} titre="Période du chiffre" vide="Choisir une période"
                libelle={nomPeriode(actuelle.p || periodeDefaut(def))} raccourcis={raccourcisCarte} Retour={FermeAuRetour}
                onChange={(v) => choisir(actuelle.id, periodeDeValeur(v, def.periodes) || periodeDefaut(def))}/>
            </div>
          ) : (
            <div className="vrm-carte-periodes vrm-seg" role="group" aria-label="Période">
              {def.periodes.map((p) => (
                <button key={p} type="button" className="vrm-seg-btn" aria-pressed={actuelle.p === p} data-carte-periode={p} onClick={() => choisir(actuelle.id, p)}>{NOM_PERIODE[p]}</button>
              ))}
            </div>
          )) : null}
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
          {poserObjectif ? <ObjectifFeuille page={page} objectif={objectif} poserObjectif={poserObjectif} /> : null}
          <button type="button" className="vrm-carte-defaut" data-carte-defaut-remettre="" onClick={() => { poser(reglageAEnregistrer(reglage, page, null)); setPlace(0); }}>Par défaut</button>
        </div>
    </SheetShell>
  );
}

// ── « Objectif » DANS LA FEUILLE (4 nov.) ───────────────────────────────────
// CA vendu ou Nombre de ventes (son choix), un montant, « OK » ; « Sur cette
// carte » (montrée ou non ici) et « Retirer ». Rien n'est enregistré tant qu'il
// n'a pas touché « OK » ; une saisie illisible n'enregistre rien.
function ObjectifFeuille({ page, objectif, poserObjectif }) {
  const [ouvert, setOuvert] = React.useState(false);
  const [type, setType] = React.useState(objectif ? objectif.type : 'ca');
  const [saisie, setSaisie] = React.useState(objectif ? String(objectif.valeur).replace('.', ',') : '');
  const lu = lireSaisieObjectif(type, saisie);
  const valider = () => { if (lu == null) return; const n = objectifAEnregistrer(objectif, { type, valeur: lu }); if (n) { poserObjectif(n); setOuvert(false); } };
  const ici = objectifSurPage(objectif, page);
  return (
    <div className="vrm-carte-objectif" data-carte-objectif={objectif ? objectif.type : ''} data-carte-objectif-ici={objectif ? (ici ? '1' : '0') : undefined}>
      <button type="button" className="vrm-carte-choix" aria-expanded={ouvert} data-carte-objectif-ouvrir="" onClick={() => setOuvert(!ouvert)}>
        <span className="vrm-carte-choix-nom">Objectif</span>
        <span className="vrm-carte-choix-v">{objectif ? (objectif.type === 'ca' ? euros(objectif.valeur) : `${objectif.valeur} ventes`) : '—'}</span>
        <span className="vrm-carte-coche" aria-hidden="true">{ouvert ? '−' : '+'}</span>
      </button>
      {ouvert ? (
        <div className="vrm-carte-objectif-corps">
          <div className="vrm-carte-objectif-types" role="group" aria-label="Type d’objectif">
            {Object.entries(TYPES_OBJECTIF).map(([k, d]) => (
              <button key={k} type="button" aria-pressed={type === k} data-carte-objectif-type={k} onClick={() => setType(k)}>{d.nom}</button>
            ))}
          </div>
          <div className="vrm-carte-objectif-saisie">
            <input type="text" inputMode={type === 'ca' ? 'decimal' : 'numeric'} aria-label={type === 'ca' ? 'Objectif en euros' : 'Objectif en nombre de ventes'} data-carte-objectif-saisie=""
              value={saisie} onChange={(e) => setSaisie(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') valider(); }} placeholder={type === 'ca' ? '2 000' : '40'} />
            <span aria-hidden="true">{type === 'ca' ? '€' : 'ventes'}</span>
            <button type="button" className="vrm-carte-ok" data-carte-objectif-ok="" disabled={lu == null} onClick={valider}>OK</button>
          </div>
          {objectif ? (
            <div className="vrm-carte-objectif-gestes">
              <button type="button" className="vrm-carte-defaut" aria-pressed={ici} data-carte-objectif-page={ici ? '1' : '0'} onClick={() => { const n = objectifAEnregistrer(objectif, { page, cacher: ici }); if (n) poserObjectif(n); }}>{ici ? 'Masquer sur cette carte' : 'Montrer sur cette carte'}</button>
              <button type="button" className="vrm-carte-defaut" data-carte-objectif-retirer="" onClick={() => { poserObjectif(objectifAEnregistrer(objectif, null)); setSaisie(''); setOuvert(false); }}>Retirer</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export { CHIFFRES, horsSelection };
