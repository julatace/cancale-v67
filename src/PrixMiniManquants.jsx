// ═══════════════════════════════════════════════════════════════════════════
// « PRIX MINI MANQUANTS » (11 nov., lot prix-mini) — Messages → Favoris & offres
// → Offres auto, juste sous l'interrupteur. Règle pure : src/prixMiniManquants.js.
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « Prix mini manquants — et le visuel doit être amélioré. »
//  1. la liste des annonces EN LIGNE dont le moteur ne lit aucun « Accepter dès » :
//     photo, N°, prix, prix d'achat relié (par identité), bénéfice à SON prix mini ;
//  2. la saisie en série : clavier décimal, Entrée = la suivante, bénéfice en direct,
//     « sous ton coût » (achat + frais saisis) dit en ambre ET redemandé avant
//     d'écrire ; UN seul « Enregistrer » (le même chemin que les seuils de l'écran,
//     `poserSeuils` → `updatePair`, normalisé « 45.5 » pour le moteur).
// ⛔ Aucun prix mini proposé ni deviné : le champ est vide tant qu'il ne tape rien.
// Rien ne part chez Vinted d'ici : c'est la fiche du N° qui change.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, monnaie } from './i18n/index.js';
import { Numero } from './composants/Numero.jsx';
import { lignesManquantes, apercuLigne, bilanSerie } from './prixMiniManquants.js';
import { Bouton, Icon, askConfirm, toast } from './App.jsx';

const PAR_PAGE = 25;
// L'euro dans la langue : « 54 € » pour un entier, « 45,50 € » sinon.
export const eur = (n, signe = false) => (n == null || !Number.isFinite(Number(n)) ? '—'
  : monnaie(Number(n), 'EUR', { ...(Number.isInteger(Number(n)) ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}), ...(signe ? { signDisplay: 'exceptZero' } : {}) }));

export default function PrixMiniManquants({ annonces, numeros, virgule = false, poserSeuils, PhotoVinted = null, nomDe = () => '' }) {
  const lignes = React.useMemo(() => lignesManquantes({ annonces, numeros, virgule }), [annonces, numeros, virgule]);
  const [saisies, setSaisies] = React.useState({});
  const [max, setMax] = React.useState(PAR_PAGE);
  const [occupe, setOccupe] = React.useState(false);
  const champs = React.useRef([]);
  const racine = React.useRef(null);
  if (lignes === null) {
    return (
      <section className="vrm-pmm" data-pmm="pas-su" aria-label={tr('prixMini.titre')}>
        <div className="vrm-pmm-tete"><span className="vrm-pmm-nombre">—</span><span className="vrm-pmm-texte"><b>{tr('prixMini.titre')}</b><span>{tr('prixMini.pasLues')}</span></span></div>
      </section>
    );
  }
  if (!lignes.length) {
    return (
      <section className="vrm-pmm vrm-pmm-ok" data-pmm="0" aria-label={tr('prixMini.titre')}>
        <div className="vrm-pmm-tete"><span className="vrm-pmm-coche" aria-hidden="true"><Icon name="check" size={18}/></span><span className="vrm-pmm-texte"><b>{tr('prixMini.toutes')}</b></span></div>
      </section>
    );
  }
  const vues = lignes.slice(0, max);
  const bilan = bilanSerie(lignes, saisies);
  const aller = (i) => {
    const suivant = champs.current[i + 1];
    if (suivant) { suivant.focus(); try { suivant.select(); } catch (_) {} }
    else { try { const b = racine.current && racine.current.querySelector('[data-pmm-enregistrer]'); if (b && !b.disabled) b.focus(); else document.activeElement && document.activeElement.blur(); } catch (_) {} }
  };
  const enregistrer = async () => {
    if (occupe || !bilan.ecrire.length || bilan.erreurs.length) return;
    if (bilan.sous.length) {
      const ok = await askConfirm({
        title: tr('prixMini.sous.titre', { n: bilan.sous.length }),
        desc: bilan.sous.map((s) => tr('prixMini.sous.ligne', { num: s.numero ? 'N°' + s.numero : tr('prixMini.sansNumero'), mini: eur(s.valeur), cout: eur(s.cout) })).join('\n'),
        ok: tr('prixMini.sous.ok'), cancel: tr('prixMini.sous.corriger'),
      });
      if (!ok) return;
    }
    setOccupe(true);
    try {
      poserSeuils && poserSeuils(bilan.ecrire);
      const n = bilan.ecrire.length;
      setSaisies((s) => { const r = { ...s }; for (const w of bilan.ecrire) delete r[w.id]; return r; });
      toast(tr('prixMini.enregistres', { n }));
    } finally { setOccupe(false); }
  };
  return (
    <section ref={racine} className="vrm-pmm" data-pmm={lignes.length} aria-label={tr('prixMini.titre')}>
      <div className="vrm-pmm-tete">
        <span className="vrm-pmm-nombre" data-pmm-nombre={lignes.length}>{lignes.length}</span>
        <span className="vrm-pmm-texte"><b>{tr('prixMini.titre')}</b><span>{tr('prixMini.sousTitre')}</span></span>
      </div>
      <ul className="vrm-pmm-liste">
        {vues.map((l, i) => {
          const a = apercuLigne(l, saisies[l.id]);
          const etat = a.erreur ? 'erreur' : a.sousCout ? 'sous' : a.valeur != null ? 'saisi' : 'vide';
          return (
            <li key={l.id} className="vrm-pmm-ligne" data-pmm-ligne={l.id} data-pmm-etat={etat} data-pmm-achat={l.achat == null ? '' : String(l.achat)}
              data-pmm-benef={a.benefice == null ? '' : String(a.benefice)} data-pmm-sous={a.sousCout ? '1' : undefined}>
              {l.photo && PhotoVinted ? <PhotoVinted src={l.photo} alt="" className="vrm-pmm-photo" loading="lazy"/> : <span className="vrm-pmm-photo vrm-pmm-photo-vide" aria-hidden="true"><Icon name="image" size={18}/></span>}
              <span className="vrm-pmm-centre">
                <span className="vrm-pmm-nom">{l.numero ? <Numero n={l.numero} taille="petit"/> : null}<span className="vrm-pmm-titre">{l.titre || tr('prixMini.sansTitre')}</span></span>
                <span className="vrm-pmm-sous">
                  <span data-pmm-prix="">{eur(l.prix)}</span>
                  <span aria-hidden="true"> · </span>
                  <span data-pmm-achat-txt="">{l.achat == null ? tr('prixMini.achatInconnu') : tr('prixMini.achete', { prix: eur(l.achat) })}</span>
                  {nomDe(l.uid) ? <span className="vrm-pmm-compte"> · {nomDe(l.uid)}</span> : null}
                </span>
              </span>
              <label className="vrm-pmm-champ" data-pmm-champ="">
                <span className="vrm-sr">{tr('prixMini.champ', { n: l.numero || '—' })}</span>
                <input ref={(el) => { champs.current[i] = el; }} value={saisies[l.id] || ''} inputMode="decimal" enterKeyHint={i < vues.length - 1 ? 'next' : 'done'}
                  placeholder={tr('prixMini.placeholder')} autoComplete="off" aria-invalid={a.erreur ? 'true' : undefined}
                  onChange={(e) => { const v = e.target.value.slice(0, 12); setSaisies((s) => ({ ...s, [l.id]: v })); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); aller(i); } }}/>
                <span aria-hidden="true">€</span>
              </label>
              <span className="vrm-pmm-benef" data-pmm-benef-txt="" aria-live="polite">
                {a.erreur ? <span className="vrm-pmm-note">{tr('prixMini.illisible')}</span>
                  : a.valeur == null ? <span className="vrm-pmm-muet">{a.cout == null ? '' : tr('prixMini.cout', { prix: eur(a.cout) })}</span>
                  : a.benefice == null ? <span className="vrm-pmm-muet">{a.raison === 'frais' ? `— ${tr('prixMini.raisonFrais')}` : '—'}</span>
                  : <><b>{eur(a.benefice, true)}</b>{a.sousCout ? <span className="vrm-pmm-note">{tr('prixMini.sousCout')}</span> : null}</>}
                {a.auPrix && !a.erreur ? <span className="vrm-pmm-note">{tr('prixMini.auPrix')}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
      {lignes.length > max ? <button type="button" className="vrm-pmm-plus" data-pmm-plus="" onClick={() => setMax((m) => m + PAR_PAGE)}>{tr('prixMini.voirPlus', { n: Math.min(PAR_PAGE, lignes.length - max) })}</button> : null}
      <div className="vrm-pmm-pied" data-pmm-pied={bilan.ecrire.length}>
        <span className="vrm-pmm-muet">{bilan.erreurs.length ? tr('prixMini.aCorriger', { n: bilan.erreurs.length })
          : bilan.ecrire.length ? tr('prixMini.prets', { n: bilan.ecrire.length }) : tr('prixMini.rienSaisi')}</span>
        <Bouton variante="primaire" data-pmm-enregistrer={bilan.ecrire.length} disabled={!bilan.ecrire.length || !!bilan.erreurs.length || occupe} onClick={enregistrer}>{tr('commun.enregistrer')}</Bouton>
      </div>
    </section>
  );
}
